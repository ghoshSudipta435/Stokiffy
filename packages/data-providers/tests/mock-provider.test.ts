/**
 * Mock provider tests for @stock-assistant/data-providers
 * Verifies mock provider behavior with synthetic data
 */

import { describe, it, expect } from 'vitest';
import {
  MockFinancialStatementProvider,
  MockMarketDataProvider,
} from '../src/external/mock-provider.js';

describe('MockFinancialStatementProvider', () => {
  const provider = new MockFinancialStatementProvider();

  it('reports itself as available', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('returns financials for known symbols', async () => {
    const result = await provider.fetchFinancials('TCS', 3);
    expect(result.statements.length).toBe(3);
    expect(result.errors.length).toBe(0);
    expect(result.symbol).toBe('TCS');
  });

  it('returns errors for unknown symbols', async () => {
    const result = await provider.fetchFinancials('UNKNOWN', 1);
    expect(result.statements.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.recoverable).toBe(false);
  });

  it('returns latest financials for known symbol', async () => {
    const result = await provider.fetchLatestFinancials('HUL');
    expect(result.statements.length).toBe(1);
    expect(result.symbol).toBe('HUL');
  });

  it('returns last fetched timestamp', async () => {
    const lastFetched = await provider.getLastFetched('TCS');
    expect(lastFetched).not.toBeNull();
  });
});

describe('MockMarketDataProvider', () => {
  const provider = new MockMarketDataProvider();

  it('reports itself as available', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('returns price history for known symbols', async () => {
    const result = await provider.fetchPriceHistory('RELIANCE', 5);
    expect(result.priceBars.length).toBe(5);
    expect(result.errors.length).toBe(0);
    expect(result.symbol).toBe('RELIANCE');
  });

  it('verifies OHLCV consistency in mock data', async () => {
    const result = await provider.fetchPriceHistory('INFY', 3);
    for (const bar of result.priceBars) {
      expect(bar.high).toBeGreaterThanOrEqual(bar.open);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.low).toBeLessThanOrEqual(bar.open);
      expect(bar.low).toBeLessThanOrEqual(bar.close);
      expect(bar.low).toBeLessThanOrEqual(bar.high);
    }
  });

  it('returns errors for unknown symbols', async () => {
    const result = await provider.fetchPriceHistory('UNKNOWN', 1);
    expect(result.priceBars.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns corporate actions result', async () => {
    const result = await provider.fetchCorporateActions('TCS', new Date());
    expect(result.corporateActions.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });
});
