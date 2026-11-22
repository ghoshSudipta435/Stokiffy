/**
 * Yahoo Finance market data provider for Indian equities.
 * Connects to Yahoo Finance using yahoo-finance2 for symbols on NSE (.NS) and BSE (.BO).
 * Implements MarketDataProvider interface with search, quote, and historical OHLCV.
 */

import YahooFinance from 'yahoo-finance2';
import type {
  MarketDataProvider,
  MarketDataResult,
} from '../interfaces/market-data-provider.js';
import type { PriceBar, DataProvenance } from '@stock-assistant/contracts';
import type { ParsedOHLCVBar } from '../csv/ohlcv-parser.js';

/**
 * Normalizes an Indian equity ticker to Yahoo Finance convention.
 * Appends .NS for NSE (default) or .BO for BSE if not already suffixed.
 */
export function toYahooSymbol(
  symbol: string,
  exchange?: 'NSE' | 'BSE' | string | undefined
): string {
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith('.NS') || clean.endsWith('.BO')) {
    return clean;
  }
  if (exchange?.toUpperCase() === 'BSE') {
    return `${clean}.BO`;
  }
  return `${clean}.NS`;
}

export interface YahooSearchResultItem {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | string;
  sector?: string | undefined;
  industry?: string | undefined;
}

export interface YahooQuoteResult {
  symbol: string;
  yahooSymbol: string;
  price: number;
  previousClose?: number | undefined;
  change?: number | undefined;
  changePercent?: number | undefined;
  volume?: number | undefined;
  fiftyTwoWeekHigh?: number | undefined;
  fiftyTwoWeekLow?: number | undefined;
  marketCap?: number | undefined;
  currency: string;
  exchange: string;
  provenance: {
    source: 'YAHOO_FINANCE';
    fetchedAt: string;
  };
}

export interface YahooHistoricalBarsResult {
  symbol: string;
  yahooSymbol: string;
  bars: ParsedOHLCVBar[];
  totalFetched: number;
  validCount: number;
  errors: string[];
}

export class YahooFinanceMarketDataProvider implements MarketDataProvider {
  readonly providerName = 'YAHOO_FINANCE';
  readonly supportsRealTime = true;
  private readonly yf: any;

  constructor(customYf?: any) {
    this.yf = customYf ?? YahooFinance;
  }

  /**
   * Search Yahoo Finance for symbols, prioritizing Indian equities (NSE & BSE).
   */
  async searchSymbols(query: string): Promise<YahooSearchResultItem[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const res = await this.yf.search(q, { quotesCount: 20 });
      if (!res || !Array.isArray(res.quotes)) {
        return [];
      }

      const results: YahooSearchResultItem[] = [];

      for (const item of res.quotes) {
        if (!item || !item.symbol) continue;

        const sym = String(item.symbol).toUpperCase();
        const exch = String(item.exchange || '').toUpperCase();

        const isNSE = sym.endsWith('.NS') || exch === 'NSI' || exch === 'NSE';
        const isBSE = sym.endsWith('.BO') || exch === 'BOM' || exch === 'BSE';

        if (isNSE || isBSE) {
          const detectedExchange: 'NSE' | 'BSE' = isBSE ? 'BSE' : 'NSE';
          const baseSymbol = sym.replace(/\.(NS|BO)$/i, '');
          const name = item.shortname || item.longname || baseSymbol;

          results.push({
            symbol: baseSymbol,
            yahooSymbol: sym,
            name,
            exchange: detectedExchange,
            sector: item.sector || undefined,
            industry: item.industry || undefined,
          });
        }
      }

      // Prioritize exact symbol match first
      const upperQ = q.toUpperCase();
      results.sort((a, b) => {
        if (a.symbol === upperQ && b.symbol !== upperQ) return -1;
        if (b.symbol === upperQ && a.symbol !== upperQ) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      return results;
    } catch {
      // Graceful error handling - never crash on network or rate limit errors
      return [];
    }
  }

  /**
   * Fetches latest quote for a symbol.
   */
  async getQuote(
    symbol: string,
    exchange?: 'NSE' | 'BSE' | undefined
  ): Promise<YahooQuoteResult | null> {
    const yahooSymbol = toYahooSymbol(symbol, exchange);
    const baseSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

    try {
      const q = await this.yf.quote(yahooSymbol);
      if (!q) return null;

      const price = q.regularMarketPrice ?? 0;
      const detectedExchange =
        exchange || (yahooSymbol.endsWith('.BO') ? 'BSE' : 'NSE');

      return {
        symbol: baseSymbol,
        yahooSymbol,
        price,
        previousClose: q.regularMarketPreviousClose ?? undefined,
        change: q.regularMarketChange ?? undefined,
        changePercent: q.regularMarketChangePercent ?? undefined,
        volume: q.regularMarketVolume ?? undefined,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? undefined,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? undefined,
        marketCap: q.marketCap ?? undefined,
        currency: q.currency ?? 'INR',
        exchange: detectedExchange,
        provenance: {
          source: 'YAHOO_FINANCE',
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches daily historical OHLCV bars between two dates with geometry validation.
   */
  async getHistoricalBars(
    symbol: string,
    fromDate: Date | string,
    toDate: Date | string,
    exchange?: 'NSE' | 'BSE' | undefined
  ): Promise<YahooHistoricalBarsResult> {
    const yahooSymbol = toYahooSymbol(symbol, exchange);
    const baseSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

    const result: YahooHistoricalBarsResult = {
      symbol: baseSymbol,
      yahooSymbol,
      bars: [],
      totalFetched: 0,
      validCount: 0,
      errors: [],
    };

    try {
      const p1 = fromDate instanceof Date ? fromDate : new Date(fromDate);
      const p2 = toDate instanceof Date ? toDate : new Date(toDate);

      const rawRows = await this.yf.historical(yahooSymbol, {
        period1: p1,
        period2: p2,
        interval: '1d',
      });

      if (!Array.isArray(rawRows)) {
        return result;
      }

      result.totalFetched = rawRows.length;

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row) continue;

        if (!row.date) {
          result.errors.push(`Row ${i + 1}: Missing date`);
          continue;
        }

        const barDate =
          row.date instanceof Date
            ? row.date.toISOString()
            : new Date(row.date).toISOString();

        if (isNaN(new Date(barDate).getTime())) {
          result.errors.push(`Row ${i + 1}: Invalid date ${String(row.date)}`);
          continue;
        }

        const open = Number(row.open);
        const high = Number(row.high);
        const low = Number(row.low);
        const close = Number(row.close);
        const volume = Math.max(0, Number(row.volume || 0));

        if (
          !Number.isFinite(open) ||
          open <= 0 ||
          !Number.isFinite(high) ||
          high <= 0 ||
          !Number.isFinite(low) ||
          low <= 0 ||
          !Number.isFinite(close) ||
          close <= 0
        ) {
          result.errors.push(
            `Row ${i + 1} (${barDate}): Non-positive or non-finite OHLC prices`
          );
          continue;
        }

        // OHLC Geometry check
        if (high < low) {
          result.errors.push(
            `Row ${i + 1} (${barDate}): High (${high}) < Low (${low})`
          );
          continue;
        }
        if (high < Math.max(open, close)) {
          result.errors.push(
            `Row ${i + 1} (${barDate}): High (${high}) < max(open, close)`
          );
          continue;
        }
        if (low > Math.min(open, close)) {
          result.errors.push(
            `Row ${i + 1} (${barDate}): Low (${low}) > min(open, close)`
          );
          continue;
        }

        const rawAdj = row.adjclose ?? (row as any).adjustedClose;
        const adjClose =
          rawAdj !== undefined && rawAdj !== null ? Number(rawAdj) : undefined;

        result.bars.push({
          date: barDate,
          open,
          high,
          low,
          close,
          volume,
          ...(adjClose !== undefined && Number.isFinite(adjClose) && adjClose > 0
            ? { adjustedClose: adjClose }
            : {}),
        });
        result.validCount++;
      }

      // Sort chronologically ascending
      result.bars.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(
        `Failed to fetch historical bars for ${yahooSymbol}: ${msg}`
      );
    }

    return result;
  }

  /**
   * Conforming to MarketDataProvider interface.
   */
  async fetchPriceHistory(
    symbol: string,
    days: number
  ): Promise<MarketDataResult> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const histResult = await this.getHistoricalBars(symbol, fromDate, toDate);

    const priceBars: PriceBar[] = histResult.bars.map((b) => ({
      id: `pb-${histResult.symbol}-${b.date}`,
      companyId: histResult.symbol,
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      adjusted: b.adjustedClose !== undefined,
      createdAt: new Date().toISOString(),
    }));

    const provenance: Record<string, DataProvenance> = {
      marketData: {
        source: 'YAHOO_FINANCE',
        fetchedAt: new Date().toISOString(),
        reportedPeriod: 'daily',
        currency: 'INR',
        unit: 'RAW',
        adjustmentStatus: 'reported',
        quality: 'verified',
        isMissing: false,
      },
    };

    return {
      symbol: histResult.symbol,
      priceBars,
      corporateActions: [],
      provenance,
      fetchedAt: new Date().toISOString(),
      errors: histResult.errors.map((msg) => ({
        field: 'historical',
        message: msg,
        recoverable: true,
      })),
    };
  }

  async fetchCorporateActions(
    symbol: string,
    _from: Date
  ): Promise<MarketDataResult> {
    return {
      symbol,
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
