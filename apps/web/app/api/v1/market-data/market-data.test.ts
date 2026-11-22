/**
 * Market Data API Route Tests
 *
 * Verifies:
 * 1. GET /api/v1/market-data/search — searches Indian equities on Yahoo Finance.
 * 2. POST /api/v1/market-data/sync-ohlcv — auto-syncs historical OHLCV bars into PostgreSQL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSearchSymbols = vi.fn();
const mockGetHistoricalBars = vi.fn();

vi.mock('@stock-assistant/data-providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/data-providers')>();
  return {
    ...actual,
    YahooFinanceMarketDataProvider: vi.fn().mockImplementation(() => ({
      searchSymbols: mockSearchSymbols,
      getHistoricalBars: mockGetHistoricalBars,
    })),
  };
});

vi.mock('@stock-assistant/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stock-assistant/db')>();
  return {
    ...actual,
    prisma: {
      company: {
        findFirst: vi.fn(),
      },
      priceBar: {
        upsert: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) =>
        callback({
          priceBar: {
            upsert: vi.fn((args) => Promise.resolve({ id: 'pb_synced', ...args.create })),
          },
          auditEvent: {
            create: vi.fn().mockResolvedValue({ id: 'audit_01' }),
          },
        })
      ),
    },
  };
});

vi.mock('@/lib/api-handler', () => import('../../../../lib/api-handler'));
vi.mock('@/lib/api-response', () => import('../../../../lib/api-response'));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

import { GET as searchRoute } from './search/route';
import { POST as syncRoute } from './sync-ohlcv/route';
import { prisma } from '@stock-assistant/db';
import { requireAuth } from '@/lib/auth';

const mockRequireAuth = vi.mocked(requireAuth);
const mockCompanyFindFirst = vi.mocked(prisma.company.findFirst);

describe('/api/v1/market-data route handlers', () => {
  const mockUser = {
    user: {
      id: 'owner_user_01',
      email: 'investor@stokiffy.local',
      name: 'Stokiffy Investor',
      role: 'OWNER' as const,
    },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sampleCompany = {
    id: 'comp_tcs',
    userId: 'owner_user_01',
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    sector: 'IT services',
    isin: 'INE467B01029',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe('GET /api/v1/market-data/search', () => {
    it('returns matching Indian equities for valid query', async () => {
      mockSearchSymbols.mockResolvedValue([
        {
          symbol: 'TCS',
          yahooSymbol: 'TCS.NS',
          name: 'Tata Consultancy Services Limited',
          exchange: 'NSE',
          sector: 'Technology',
          industry: 'Information Technology Services',
        },
        {
          symbol: 'TCS',
          yahooSymbol: 'TCS.BO',
          name: 'Tata Consultancy Services Ltd',
          exchange: 'BSE',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/market-data/search?q=TCS');
      const res = await searchRoute(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].symbol).toBe('TCS');
      expect(body.data[0].yahooSymbol).toBe('TCS.NS');
      expect(mockSearchSymbols).toHaveBeenCalledWith('TCS');
    });

    it('rejects query shorter than 2 characters with 400 VALIDATION_FAILED', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/market-data/search?q=T');
      const res = await searchRoute(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/market-data/sync-ohlcv', () => {
    it('returns 404 when company does not exist', async () => {
      mockCompanyFindFirst.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/market-data/sync-ohlcv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'UNKNOWN_COMP',
        }),
      });

      const res = await syncRoute(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('fetches historical bars, upserts them into PriceBar, and logs AuditEvent', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);
      mockGetHistoricalBars.mockResolvedValue({
        symbol: 'TCS',
        yahooSymbol: 'TCS.NS',
        bars: [
          {
            date: '2024-03-25T00:00:00.000Z',
            open: 3200,
            high: 3250,
            low: 3180,
            close: 3240,
            volume: 1500000,
            adjustedClose: 3240,
          },
          {
            date: '2024-03-26T00:00:00.000Z',
            open: 3245,
            high: 3260,
            low: 3210,
            close: 3225,
            volume: 980000,
            adjustedClose: 3225,
          },
        ],
        totalFetched: 2,
        validCount: 2,
        errors: [],
      });

      const req = new NextRequest('http://localhost:3000/api/v1/market-data/sync-ohlcv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_tcs',
          days: 180,
        }),
      });

      const res = await syncRoute(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.syncedCount).toBe(2);
      expect(body.data.latestPrice).toBe(3225);
      expect(body.data.latestDate).toBe('2024-03-26T00:00:00.000Z');
      expect(body.data.yahooSymbol).toBe('TCS.NS');
    });

    it('returns 400 when Yahoo returns 0 bars with errors', async () => {
      mockCompanyFindFirst.mockResolvedValue(sampleCompany as any);
      mockGetHistoricalBars.mockResolvedValue({
        symbol: 'TCS',
        yahooSymbol: 'TCS.NS',
        bars: [],
        totalFetched: 0,
        validCount: 0,
        errors: ['Ticker not found on Yahoo Finance'],
      });

      const req = new NextRequest('http://localhost:3000/api/v1/market-data/sync-ohlcv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_tcs',
        }),
      });

      const res = await syncRoute(req, { params: {} });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
