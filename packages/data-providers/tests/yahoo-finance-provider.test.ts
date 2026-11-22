import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  YahooFinanceMarketDataProvider,
  toYahooSymbol,
} from '../src/external/yahoo-finance-provider.js';

describe('toYahooSymbol', () => {
  it('appends .NS for standard NSE symbol', () => {
    expect(toYahooSymbol('TCS')).toBe('TCS.NS');
    expect(toYahooSymbol('TCS', 'NSE')).toBe('TCS.NS');
    expect(toYahooSymbol('infy')).toBe('INFY.NS');
  });

  it('appends .BO when exchange is BSE', () => {
    expect(toYahooSymbol('TCS', 'BSE')).toBe('TCS.BO');
    expect(toYahooSymbol('532540', 'bse')).toBe('532540.BO');
  });

  it('preserves existing .NS or .BO suffix', () => {
    expect(toYahooSymbol('TCS.NS')).toBe('TCS.NS');
    expect(toYahooSymbol('TCS.BO')).toBe('TCS.BO');
    expect(toYahooSymbol('RELIANCE.NS', 'BSE')).toBe('RELIANCE.NS');
    expect(toYahooSymbol('500325.BO', 'NSE')).toBe('500325.BO');
  });

  it('trims whitespace and converts to uppercase', () => {
    expect(toYahooSymbol('  hdfcbank  ')).toBe('HDFCBANK.NS');
    expect(toYahooSymbol('  wipro.bo  ')).toBe('WIPRO.BO');
  });
});

describe('YahooFinanceMarketDataProvider', () => {
  let mockYf: {
    search: ReturnType<typeof vi.fn>;
    quote: ReturnType<typeof vi.fn>;
    historical: ReturnType<typeof vi.fn>;
  };
  let provider: YahooFinanceMarketDataProvider;

  beforeEach(() => {
    mockYf = {
      search: vi.fn(),
      quote: vi.fn(),
      historical: vi.fn(),
    };
    provider = new YahooFinanceMarketDataProvider(mockYf);
  });

  describe('searchSymbols', () => {
    it('filters for Indian equities and normalizes output', async () => {
      mockYf.search.mockResolvedValue({
        quotes: [
          {
            symbol: 'AAPL',
            shortname: 'Apple Inc.',
            exchange: 'NMS',
          },
          {
            symbol: 'TCS.NS',
            shortname: 'Tata Consultancy Services Limited',
            exchange: 'NSI',
            sector: 'Technology',
            industry: 'Information Technology Services',
          },
          {
            symbol: 'TCS.BO',
            shortname: 'Tata Consultancy Services Ltd',
            exchange: 'BOM',
          },
          {
            symbol: 'TATACONSUM.NS',
            shortname: 'Tata Consumer Products Limited',
            exchange: 'NSE',
          },
        ],
      });

      const results = await provider.searchSymbols('TCS');

      expect(results).toHaveLength(3);
      expect(results[0]?.symbol).toBe('TCS');
      expect(results[0]?.yahooSymbol).toBe('TCS.NS');
      expect(results[0]?.exchange).toBe('NSE');
      expect(results[0]?.sector).toBe('Technology');

      expect(results[1]?.symbol).toBe('TCS');
      expect(results[1]?.yahooSymbol).toBe('TCS.BO');
      expect(results[1]?.exchange).toBe('BSE');

      expect(results[2]?.symbol).toBe('TATACONSUM');
      expect(results[2]?.exchange).toBe('NSE');
    });

    it('returns empty array when query is empty or search fails', async () => {
      const emptyRes = await provider.searchSymbols('   ');
      expect(emptyRes).toEqual([]);

      mockYf.search.mockRejectedValue(new Error('Rate limit exceeded (HTTP 429)'));
      const errorRes = await provider.searchSymbols('INFY');
      expect(errorRes).toEqual([]);
    });
  });

  describe('getQuote', () => {
    it('fetches and maps real-time quote with provenance metadata', async () => {
      mockYf.quote.mockResolvedValue({
        symbol: 'TCS.NS',
        regularMarketPrice: 3240.5,
        regularMarketPreviousClose: 3200.0,
        regularMarketChange: 40.5,
        regularMarketChangePercent: 1.26,
        regularMarketVolume: 1250000,
        fiftyTwoWeekHigh: 3600.0,
        fiftyTwoWeekLow: 3000.0,
        marketCap: 1170000000000,
        currency: 'INR',
      });

      const quote = await provider.getQuote('TCS');

      expect(quote).not.toBeNull();
      expect(quote?.symbol).toBe('TCS');
      expect(quote?.yahooSymbol).toBe('TCS.NS');
      expect(quote?.price).toBe(3240.5);
      expect(quote?.previousClose).toBe(3200.0);
      expect(quote?.fiftyTwoWeekHigh).toBe(3600.0);
      expect(quote?.currency).toBe('INR');
      expect(quote?.exchange).toBe('NSE');
      expect(quote?.provenance.source).toBe('YAHOO_FINANCE');
      expect(quote?.provenance.fetchedAt).toBeDefined();
    });

    it('returns null on unknown symbol or network error without throwing', async () => {
      mockYf.quote.mockRejectedValue(new Error('Not found'));
      const result = await provider.getQuote('UNKNOWN_SYMBOL_999');
      expect(result).toBeNull();
    });
  });

  describe('getHistoricalBars', () => {
    it('fetches daily OHLCV bars, validates geometry, and sorts chronologically', async () => {
      mockYf.historical.mockResolvedValue([
        {
          date: new Date('2024-03-26T00:00:00.000Z'),
          open: 3245,
          high: 3260,
          low: 3210,
          close: 3225,
          adjclose: 3215,
          volume: 980000,
        },
        {
          date: new Date('2024-03-25T00:00:00.000Z'),
          open: 3200,
          high: 3250,
          low: 3180,
          close: 3240,
          adjclose: 3230,
          volume: 1500000,
        },
      ]);

      const result = await provider.getHistoricalBars('TCS', '2024-03-25', '2024-03-26');

      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.bars).toHaveLength(2);

      // Verify chronological sort (25th before 26th)
      expect(result.bars[0]?.date).toBe('2024-03-25T00:00:00.000Z');
      expect(result.bars[0]?.open).toBe(3200);
      expect(result.bars[0]?.high).toBe(3250);
      expect(result.bars[0]?.low).toBe(3180);
      expect(result.bars[0]?.close).toBe(3240);
      expect(result.bars[0]?.adjustedClose).toBe(3230);
      expect(result.bars[0]?.volume).toBe(1500000);

      expect(result.bars[1]?.date).toBe('2024-03-26T00:00:00.000Z');
    });

    it('filters out malformed prices and geometry breaches', async () => {
      mockYf.historical.mockResolvedValue([
        {
          date: new Date('2024-03-25T00:00:00.000Z'),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
        {
          date: new Date('2024-03-26T00:00:00.000Z'),
          open: 100,
          high: 90, // invalid geometry: high < open
          low: 95,
          close: 98,
          volume: 1000,
        },
        {
          date: new Date('2024-03-27T00:00:00.000Z'),
          open: -50, // invalid price: negative
          high: 100,
          low: 40,
          close: 60,
          volume: 1000,
        },
      ]);

      const result = await provider.getHistoricalBars('TCS', '2024-03-25', '2024-03-27');

      expect(result.totalFetched).toBe(3);
      expect(result.validCount).toBe(1);
      expect(result.bars).toHaveLength(1);
      expect(result.bars[0]?.date).toBe('2024-03-25T00:00:00.000Z');
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('handles network errors gracefully and records message', async () => {
      mockYf.historical.mockRejectedValue(new Error('Connection timeout'));

      const result = await provider.getHistoricalBars('TCS', '2024-03-25', '2024-03-26');

      expect(result.validCount).toBe(0);
      expect(result.bars).toEqual([]);
      expect(result.errors[0]).toContain('Connection timeout');
    });
  });

  describe('fetchPriceHistory (MarketDataProvider interface)', () => {
    it('returns MarketDataResult conforming to contract', async () => {
      mockYf.historical.mockResolvedValue([
        {
          date: new Date('2024-03-25T00:00:00.000Z'),
          open: 1500,
          high: 1530,
          low: 1490,
          close: 1520,
          adjclose: 1515,
          volume: 2000000,
        },
      ]);

      const result = await provider.fetchPriceHistory('INFY', 30);

      expect(result.symbol).toBe('INFY');
      expect(result.priceBars).toHaveLength(1);
      expect(result.priceBars[0]?.open).toBe(1500);
      expect(result.priceBars[0]?.close).toBe(1520);
      expect(result.provenance.marketData?.source).toBe('YAHOO_FINANCE');
      expect(await provider.isAvailable()).toBe(true);
      expect(await provider.getLastFetched('INFY')).toBeDefined();
    });
  });
});
